import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { chapterSource } from '@/content';
import { HELD_BACK_EXPRESSIONS, portraitCast } from '@/content/portrait-cast';
import { appearanceKey } from '@/domain/appearance-key';
import type { Chapter } from '@/domain/chapter';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import { EXPRESSIONS, type Expression } from '@/domain/dialogue';
import {
  PORTRAIT_DIR,
  PORTRAIT_SIZES,
  portraitFolder,
  portraitImage,
} from '@/features/portraits/portrait-art';
import manifest from '@/features/portraits/portrait-manifest.json';

/**
 * Portraits (tools/art/build_portraits.py, `npm run art:portraits`): everyone
 * who speaks in any chapter, and every player look, has one, rendered from
 * how they look now, in every expression their lines carry, with every size
 * on disk and recorded provenance; and each render's own measurements (skin
 * colour against the person's colour in the game; where the eyes look) are
 * within bounds.
 *
 * Two steps can fall behind the content, and each has a check here:
 * the portrait data (`npm run art:portrait-data`) and the renders.
 */
const ROOT = join(__dirname, '..', '..');
const DIR = join(ROOT, 'public', PORTRAIT_DIR);
const entries: Record<string, { appearance: string; kind: string; expressions?: string[] }> =
  manifest;

interface Check {
  skin: { target: string; measured: string | null; deltaE: number | null; gain: number[] };
  gaze: { yaw: number[]; across: number[]; height: number[]; miss: number };
}
const checks = JSON.parse(
  readFileSync(join(ROOT, 'tools', 'art', 'data', 'portrait-checks.json'), 'utf8'),
) as Record<string, Check>;

const data = JSON.parse(
  readFileSync(join(ROOT, 'tools', 'art', 'data', 'portrait-people.json'), 'utf8'),
) as {
  characters: Array<{
    id: string;
    character: string;
    chapter: string;
    key: string;
    expressions: string[];
    appearance: { skin: string };
  }>;
  players: Array<{ id: string; key: string; appearance: { skin: string } }>;
};
/** A portrait's skin colour as the game shows the person (the portrait data's). */
const skinOf = (id: string) =>
  (data.characters.find((c) => c.id === id) ?? data.players.find((p) => `player-${p.id}` === id))
    ?.appearance.skin;
const people = [
  ...data.characters.map((c) => ({
    id: c.id,
    key: c.key,
    kind: 'character',
    expressions: c.expressions,
  })),
  ...data.players.map((p) => ({
    id: `player-${p.id}`,
    key: p.key,
    kind: 'player',
    expressions: [] as string[],
  })),
];
/** Every portrait that should exist: [id, expression]. */
const renders: Array<[string, Expression]> = people.flatMap((p) => [
  [p.id, 'neutral'] as [string, Expression],
  ...p.expressions.map((e) => [p.id, e as Expression] as [string, Expression]),
]);

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

/** Every portrait file on disk, as paths under the portraits folder ("ezer-512.webp", "angry/ezer-512.webp"). */
function portraitFiles(): string[] {
  return readdirSync(DIR, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? readdirSync(join(DIR, d.name)).map((f) => `${d.name}/${f}`) : [d.name],
  );
}

const checkKey = (id: string, e: Expression) => (e === 'neutral' ? id : `${id}~${e}`);

describe('portraits', () => {
  it('the portrait data covers every chapter as it is now (else: npm run art:portrait-data)', () => {
    expect(chapters.length).toBeGreaterThanOrEqual(4);
    const { sitters } = portraitCast(chapters);
    expect(
      data.characters.map((c) => [c.id, c.chapter, c.character, c.key, c.expressions]),
      'tools/art/data/portrait-people.json is stale: run npm run art:portrait-data',
    ).toEqual(
      sitters.map((s) => [
        s.portraitId,
        s.chapterId,
        s.characterId,
        appearanceKey(s.character.appearance),
        s.expressions,
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

  it('every expression a speaker’s lines carry has a rendered portrait, in every size (held-back ones show neutral)', () => {
    const lines = chapters.flatMap((c) =>
      c.dialogues.flatMap((d) =>
        d.nodes
          .filter((n) => n.expression !== 'neutral')
          .map((n) => ({ chapter: c, speaker: n.speaker, expression: n.expression })),
      ),
    );
    expect(lines.length).toBeGreaterThan(150);
    const { sitters } = portraitCast(chapters);
    for (const l of lines) {
      const sitter = sitters.find(
        (s) => s.chapterId === l.chapter.id && s.characterId === l.speaker,
      );
      // Only characters who have portraits carry expressions (not the player or narrator).
      expect(sitter, `${l.chapter.id}: ${l.speaker} has a portrait`).toBeDefined();
      if (!sitter) continue;
      const art = portraitImage(
        sitter.character.appearance,
        sitter.characterId,
        l.expression,
        entries,
        '/',
      );
      // A held-back expression shows the speaker's neutral portrait until it is reworked.
      const shown = HELD_BACK_EXPRESSIONS.has(l.expression) ? 'neutral' : l.expression;
      expect(art?.expression, `${sitter.portraitId} ${l.expression}`).toBe(shown);
      for (const size of PORTRAIT_SIZES)
        expect(
          existsSync(
            join(ROOT, 'public', portraitFolder(shown), `${sitter.portraitId}-${size}.webp`),
          ),
          `${shown}/${sitter.portraitId}-${size}.webp`,
        ).toBe(true);
    }
  });

  it('Ezer shouts “Cheated!” with an angry face', () => {
    const ch1 = chapters.find((c) => c.id === 'road-to-jericho');
    const line = ch1?.dialogues.find((d) => d.id === 'd-ezer')?.nodes.find((n) => n.id === 'e1');
    expect(line?.text).toMatch(/^Cheated!/);
    expect(line?.expression).toBe('angry');
    expect(entries.ezer?.expressions).toContain('angry');
  });

  it('Aunt Miriam greets the player with a glad face, from its own file', () => {
    // The first face a player sees: the smile that was held back until it was reworked.
    const ch1 = chapters.find((c) => c.id === 'road-to-jericho');
    const line = ch1?.dialogues.find((d) => d.id === 'd-opening')?.nodes.find((n) => n.id === 'n2');
    expect(line?.speaker).toBe('miriam');
    expect(line?.expression).toBe('glad');
    expect(entries.miriam?.expressions).toContain('glad');
    const miriam = ch1?.characters.find((c) => c.id === 'miriam');
    if (!miriam) throw new Error('Aunt Miriam is missing');
    const art = portraitImage(miriam.appearance, 'miriam', 'glad', entries, '/');
    expect(art?.expression).toBe('glad');
    expect(art?.src).toMatch(/\/art\/portraits\/glad\/miriam-256\.webp$/);
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
    const files = portraitFiles();
    expect(files.length).toBe(renders.length * PORTRAIT_SIZES.length);
    for (const [id, entry] of Object.entries(entries)) {
      const person = people.find((p) => p.id === id);
      expect(person, `${id} is in the manifest but nobody needs it`).toBeDefined();
      expect(
        [...(entry.expressions ?? [])].sort(),
        `${id}: the expressions rendered are the ones its lines carry`,
      ).toEqual([...(person?.expressions ?? [])].sort());
    }
    for (const f of files) {
      const m = /^(?:([a-z]+)\/)?(.+)-(\d+)\.webp$/.exec(f);
      expect(m, f).not.toBeNull();
      if (!m) continue;
      const [, folder, id = '', size] = m;
      if (folder) expect(EXPRESSIONS as readonly string[], f).toContain(folder);
      expect(entries[id], `${f} belongs to someone in the manifest`).toBeDefined();
      if (folder) expect(entries[id]?.expressions, f).toContain(folder);
      expect(PORTRAIT_SIZES as readonly number[]).toContain(Number(size));
      const rel = `public/${PORTRAIT_DIR}${f}`;
      expect(
        assets.some((a) => glob(a.path, rel) && a.origin.includes('build_portraits.py')),
        `${rel} is recorded in docs/art/asset-manifest.json`,
      ).toBe(true);
    }
  });

  it('every file is a square WebP of the size its name gives', () => {
    for (const f of portraitFiles()) {
      const size = Number(/-(\d+)\.webp$/.exec(f)?.[1]);
      expect(webpSize(readFileSync(join(DIR, f))), f).toEqual({ width: size, height: size });
    }
  });

  it('every face is the colour the person is in the game (the render measured itself)', () => {
    for (const [id, e] of renders) {
      const c = checks[checkKey(id, e)];
      expect(c, `${checkKey(id, e)}: no measurements (re-render it)`).toBeDefined();
      if (!c) continue;
      // Measured against the colour the game shows them in.
      expect(c.skin.target, checkKey(id, e)).toBe(skinOf(id));
      if (e === 'neutral') {
        // ΔE (CIE76) of the lit skin against Appearance.skin: under about 2
        // is hard to see, under 4 a close match.
        expect(c.skin.deltaE, `${id} skin ${c.skin.measured} vs ${c.skin.target}`).toBeLessThan(4);
      } else {
        // Every expression takes the neutral portrait's correction, so a
        // person's skin never changes between lines (the measurement moves
        // a little with an open mouth or narrowed eyes).
        expect(c.skin.gain, checkKey(id, e)).toEqual(checks[id]?.skin.gain);
        expect(c.skin.deltaE, checkKey(id, e)).toBeLessThan(7);
      }
    }
  });

  it('both eyes look at one point, and each pupil shows in its opening', () => {
    for (const [id, e] of renders) {
      const g = checks[checkKey(id, e)]?.gaze;
      expect(g, checkKey(id, e)).toBeDefined();
      if (!g) continue;
      const where = `${checkKey(id, e)} ${JSON.stringify(g)}`;
      // The lines of sight meet (within a few millimetres), each passing
      // the camera by the same angle (0, or a few degrees for a mood).
      expect(g.miss, where).toBeLessThan(0.5);
      expect(Math.abs((g.yaw[0] ?? 99) - (g.yaw[1] ?? 0)), where).toBeLessThan(1.5);
      for (const k of [0, 1]) {
        expect(Math.abs(g.yaw[k] ?? 99), where).toBeLessThan(10);
        // In the picture: not pressed into a corner, not hidden under a lid.
        expect(g.across[k], where).toBeGreaterThan(0.15);
        expect(g.across[k], where).toBeLessThan(0.85);
        // (Measured against the lid margins before the skin is smoothed, and old
        // people's heavy lids cover the top of the iris: a little below 0 still shows.)
        expect(g.height[k], where).toBeGreaterThan(-0.5);
        expect(g.height[k], where).toBeLessThan(0.95);
      }
    }
  });

  it('the portraits guide shows only review pictures that exist, and every one of them', () => {
    const guide = readFileSync(join(ROOT, 'docs', 'art', 'portraits.md'), 'utf8');
    const linked = new Set([...guide.matchAll(/\(portraits\/([^)\s]+\.webp)\)/g)].map((m) => m[1]));
    const sheets = readdirSync(join(ROOT, 'docs', 'art', 'portraits'));
    expect(linked.size).toBeGreaterThan(5);
    for (const f of linked) expect(sheets, `docs/art/portraits/${f ?? ''}`).toContain(f);
    for (const f of sheets)
      expect([...linked], `${f} is not in docs/art/portraits.md`).toContain(f);
  });

  it('stays small: the neutral portraits precached, the expressions cached on first use', () => {
    let neutral = 0;
    let all = 0;
    for (const f of portraitFiles()) {
      const size = statSync(join(DIR, f)).size;
      all += size;
      if (!f.includes('/')) neutral += size;
      if (f.endsWith('-128.webp')) expect(size, f).toBeLessThan(12_000);
      if (f.endsWith('-256.webp')) expect(size, f).toBeLessThan(32_000);
      if (f.endsWith('-512.webp')) expect(size, f).toBeLessThan(80_000);
    }
    expect(neutral).toBeLessThan(3_500_000);
    expect(all).toBeLessThan(12_000_000);
  });
});

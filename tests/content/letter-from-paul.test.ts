import { describe, expect, it } from 'vitest';
import { chapterSource, parseChapter } from '@/content';
import { LETTER_FROM_PAUL } from '@/content/chapters/letter-from-paul';
import { contentReport, reachabilityIssues } from '@/content/validation';
import { validateChapterIntegrity } from '@/domain/chapter-integrity';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import { EDUCATIONAL_KINDS } from '@/domain/content-records';
import { parseLayout, type TileKind } from '@/domain/world';
import { nextColumn, paintBuildings } from '@/game/art/architecture';
import { LOOKS } from '@/game/art/direction';
import { paintFurnishing } from '@/game/art/furnishings';
import { paintNatureProp, paintTravertine } from '@/game/art/nature';
import type { Ctx } from '@/game/art/paint';
import { dressFor } from '@/game/art/people/dress';
import { itemsOf, paintCarry } from '@/game/art/people/gear';
import { frameSpec, rigFor } from '@/game/art/people/rig';
import { paintProp } from '@/game/art/props';
import { findLights, isPropTile, isStructure, readSite } from '@/game/art/site';
import { groundColor } from '@/game/art/terrain';

const chapter = parseChapter(LETTER_FROM_PAUL);
const nodes = chapter.dialogues.flatMap((d) => d.nodes.map((n) => ({ ...n, dialogue: d.id })));
const allText = (): string[] => [
  ...nodes.flatMap((n) => [n.text, ...n.choices.map((c) => c.text)]),
  ...chapter.records.map((r) => r.body ?? ''),
  ...chapter.clues.map((c) => c.text),
  ...chapter.summary.consequences.map((c) => c.text),
  ...chapter.summary.recap.map((c) => c.text),
  ...chapter.scriptureConnection.comparisons.map((c) => c.text),
  ...chapter.choices.flatMap((c) => c.options.flatMap((o) => [o.label, o.consequence])),
];
const BIBLICAL = ['philemon', 'tychicus', 'onesimus'];

describe('A Letter from Paul content', () => {
  it('passes schema and referential integrity validation', () => {
    expect(validateChapterIntegrity(chapter)).toEqual([]);
  });

  it('lets the player reach every interactive thing and exit from every spawn', () => {
    expect(reachabilityIssues(chapter)).toEqual([]);
  });

  it('loads lazily through the chapter registry, with its title unchanged', async () => {
    const meta = chapterSource.list().find((m) => m.id === 'letter-from-paul');
    expect(meta).toMatchObject({ title: 'A Letter from Paul', available: true, number: 4 });
    const loaded = await chapterSource.load('letter-from-paul');
    expect(loaded.id).toBe('letter-from-paul');
    expect(loaded.scenes).toHaveLength(4);
  });

  it('uses all four puzzle types', () => {
    expect(new Set(chapter.puzzles.map((p) => p.type))).toEqual(
      new Set(['sequence', 'packing', 'measuring', 'deduction']),
    );
  });

  it('has a main quest and a genuinely optional side quest with an alternate outcome', () => {
    expect(chapter.quests.find((q) => q.kind === 'main')?.id).toBe(chapter.mainQuest);
    const side = chapter.quests.filter((q) => q.kind === 'side');
    expect(side).toHaveLength(1);
    expect(side[0]?.autoStart).toBe(false);
    expect(side[0]?.outcomes.some((o) => o.kind === 'alternate')).toBe(true);
    // Nothing in the main quest depends on the side quest.
    expect(JSON.stringify(chapter.quests.find((q) => q.kind === 'main'))).not.toMatch(/q-bundle/);
  });

  it('never embeds verse text: Scripture records are references, retellings are labelled paraphrase', () => {
    chapter.records
      .filter((r) => r.kind === 'scripture')
      .forEach((r) => {
        expect(r.body, r.id).toBeUndefined();
        expect(r.scripture?.length, r.id).toBeGreaterThan(0);
      });
    // Every line of the reading retells a letter, so it must be a labelled paraphrase…
    const reading = nodes.filter((n) => n.dialogue === 'd-reading' && /Paul/.test(n.text));
    expect(reading.length).toBeGreaterThanOrEqual(8);
    reading
      .filter((n) => n.id !== 'r5')
      .forEach((n) => {
        expect(n.kind, n.id).toBe('paraphrase');
        const record = chapter.records.find((r) => r.id === n.recordId);
        expect(record?.kind, n.id).toBe('paraphrase');
        expect(record?.checkedAgainstTranslation).toBe('WEB');
      });
    // …in our own words: no quotation marks that could pass for a translation.
    nodes
      .filter((n) => n.kind === 'paraphrase')
      .forEach((n) => expect(n.text, n.id).not.toMatch(/[“”"]/));
  });

  it('keeps Paul and Jesus off-stage, and the people named in Scripture silent and uncontrolled', () => {
    const names = chapter.characters.map((c) => c.name.toLowerCase());
    expect(names.some((n) => /jesus|paul\b/.test(n))).toBe(false);
    const biblical = chapter.characters.filter((c) => c.biblicalFigure);
    expect(biblical.map((c) => c.id).sort()).toEqual([...BIBLICAL].sort());
    biblical.forEach((c) => expect(c.fictional).toBe(false));
    chapter.characters
      .filter((c) => !c.biblicalFigure)
      .forEach((c) => expect(c.fictional, c.id).toBe(true));
    // They never speak, never own a conversation, and can't be talked to.
    nodes.forEach((n) => expect(BIBLICAL).not.toContain(n.speaker));
    nodes.forEach((n) => expect(n.speaker).not.toMatch(/jesus|paul/i));
    chapter.dialogues.forEach((d) => expect(BIBLICAL).not.toContain(d.characterId));
    chapter.scenes
      .flatMap((s) => s.entities)
      .filter((e) => e.characterId && BIBLICAL.includes(e.characterId))
      .forEach((e) => expect(e.interaction, e.id).toBeUndefined());
  });

  it('contains no faith, holiness or salvation scoring language', () => {
    const text = allText().join('\n');
    expect(text).not.toMatch(
      /\b(faith|holiness|salvation|righteousness|forgiveness) (score|points|meter|level)\b/i,
    );
    expect(text).not.toMatch(/\bgood Christian answer\b/i);
    expect(text).not.toMatch(/\byou (sinned|failed God)\b/i);
  });

  it('treats slavery seriously: no choice buys, sells or frees a person, and no puzzle uses them', () => {
    const choices = nodes.flatMap((n) => n.choices.map((c) => c.text)).join('\n');
    expect(choices).not.toMatch(
      /\b(buy|sell|free|own|trade)\b[^.?!]{0,20}\b(her|him|chrysis|onesimus|slave)/i,
    );
    const puzzles = JSON.stringify(chapter.puzzles);
    expect(puzzles).not.toMatch(/chrysis|onesimus|slave/i);
    expect(chapter.items.map((i) => i.name).join(' ')).not.toMatch(/slave/i);
  });

  it('presents the disputed questions as open, with a sensitivity note', () => {
    for (const id of [
      'rec-interp-onesimus',
      'rec-interp-prison',
      'rec-interp-authorship',
      'rec-interp-slavery',
      'rec-interp-laodicea-letter',
    ]) {
      const record = chapter.records.find((r) => r.id === id);
      expect(record?.kind, id).toBe('interpretation');
      expect(record?.governance.denominationalSensitivity, id).not.toBe('none');
      expect(record?.governance.sensitivityNote, id).toBeTruthy();
    }
    const onesimus = chapter.records.find((r) => r.id === 'rec-interp-onesimus')?.body ?? '';
    expect(onesimus).toMatch(/never says/);
    expect(onesimus).toMatch(/brother/); // the minority view is included, not only the majority
  });

  it('labels the invented gathering, reader and road as fiction or reconstruction', () => {
    expect(chapter.records.find((r) => r.id === 'rec-pl-house')?.kind).toBe('fiction');
    expect(chapter.records.find((r) => r.id === 'rec-pl-house')?.body).toMatch(
      /does not say where, when or by whom/,
    );
    expect(chapter.records.find((r) => r.id === 'rec-rec-road')?.kind).toBe('reconstruction');
    expect(chapter.records.find((r) => r.id === 'rec-rec-house')?.kind).toBe('reconstruction');
    // Fiction never carries Scripture references.
    chapter.records
      .filter((r) => r.kind === 'fiction')
      .forEach((r) => expect(r.scripture, r.id).toBeUndefined());
  });

  it('marks all educational content as awaiting human review (none self-approved)', () => {
    const report = contentReport(chapter);
    expect(report.approved).toBe(0);
    expect(report.awaitingReview).toBe(report.educational);
    chapter.records.forEach((r) => {
      expect(r.governance.provenance, r.id).toBe('ai-assisted');
      expect(r.governance.reviewer, r.id).toBeUndefined();
    });
    chapter.records
      .filter((r) => EDUCATIONAL_KINDS.includes(r.kind))
      .forEach((r) => expect(['ai-draft', 'sources-attached']).toContain(r.governance.status));
  });

  it('cites only sources that were actually retrieved, and uses every one it lists', () => {
    expect(chapter.sources.every((s) => s.verified && s.url && s.accessed)).toBe(true);
    const cited = new Set(chapter.records.flatMap((r) => r.sources));
    expect(chapter.sources.filter((s) => !cited.has(s.id)).map((s) => s.id)).toEqual([]);
  });

  it('offers a real choice at the dye works: at least three options, none a morality button', () => {
    const decide = chapter.dialogues
      .find((d) => d.id === 'd-kallias')
      ?.nodes.find((n) => n.id === 'decide');
    const recorded = decide?.choices.filter((c) =>
      c.effects.some((e) => e.type === 'recordChoice'),
    );
    expect(recorded?.length).toBeGreaterThanOrEqual(3);
    decide?.choices.forEach((c) =>
      expect(c.text).not.toMatch(/\b(good|evil|right thing|wrong thing|sin)\b/i),
    );
    // A constraint is shown, not hidden: writing needs tablets, and says so.
    const write = decide?.choices.find((c) => c.id === 'write');
    expect(write?.requires).toBeDefined();
    expect(write?.unavailableText).toBeTruthy();
  });

  it('only asks the player to pack things the packing screen offers (items with weight)', () => {
    const packable = new Set(chapter.items.filter((i) => i.weight > 0).map((i) => i.id));
    const includes = (rule: unknown): string[] => {
      const r = rule as { type: string; item?: string; of?: unknown[] };
      if (r.type === 'includes' && r.item) return [r.item];
      return (r.of ?? []).flatMap(includes);
    };
    chapter.puzzles.forEach((p) => {
      if (p.type !== 'packing') return;
      const required = p.rules.flatMap((r) => includes(r.rule));
      required.forEach((item) => expect(packable.has(item), `${p.id} needs ${item}`).toBe(true));
    });
  });

  it('sets the chapter on the real map: the Lycus valley road runs through rain', () => {
    const road = chapter.scenes.find((s) => s.id === 'lycus-road');
    expect(road?.weather).toBe('clear');
    expect(road?.weatherChanges.map((c) => c.weather)).toContain('rain');
  });
});

// ── Art: everything the chapter's maps and people use is actually drawn ─────
/** A canvas context that records calls (node has no canvas). */
function recordingCtx(): { ctx: Ctx; calls: string[] } {
  const calls: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get: (target, prop) =>
      prop in target
        ? target[prop]
        : (): unknown => {
            calls.push(String(prop));
            return gradient;
          },
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    },
  }) as unknown as Ctx;
  return { ctx, calls };
}

function recordingDocument(): Document {
  return {
    createElement: () => ({ width: 0, height: 0, getContext: () => recordingCtx().ctx }),
  } as unknown as Document;
}

describe('A Letter from Paul art support', () => {
  const kinds = new Set<TileKind>(chapter.scenes.flatMap((s) => parseLayout(s).tiles.flat()));

  it('draws every standing object the maps use', () => {
    const look = LOOKS.city;
    for (const kind of [...kinds].filter(isPropTile)) {
      const { ctx, calls } = recordingCtx();
      const painted = paintFurnishing(ctx, kind, look, 7) || paintNatureProp(ctx, kind, look, 7);
      const trunk = kind === 'fig' || kind === 'olive' || kind === 'palm';
      expect(painted || trunk, kind).toBe(true);
      if (!trunk) expect(calls.length, kind).toBeGreaterThan(0);
    }
  });

  it('draws terracotta roofs, travertine terraces and the new ground surfaces', () => {
    const grid = parseLayout({
      id: 'art',
      layout: ['TTXX', '##XX', 'xrBw'],
      legend: {
        T: 'tile-roof',
        '#': 'wall',
        X: 'travertine',
        x: 'mosaic',
        r: 'roman-road',
        B: 'bridge',
        w: 'water',
      },
    });
    const site = readSite(grid, 'paving');
    expect(isStructure('tile-roof') && isStructure('travertine')).toBe(true);
    expect(site.isFrontWall(0, 1)).toBe(true); // a wall under a tiled roof is a building front
    const roofs = recordingCtx();
    paintBuildings(roofs.ctx, site, LOOKS.city);
    expect(roofs.calls.length).toBeGreaterThan(40);
    const terraces = recordingCtx();
    paintTravertine(terraces.ctx, site);
    expect(terraces.calls.length).toBeGreaterThan(20);
    for (const ground of ['mosaic', 'roman-road', 'bridge'] as const)
      expect(groundColor(LOOKS.city, ground), ground).not.toBe(groundColor(LOOKS.city, 'sand'));
  });

  it('carries one beam along each colonnade, across the gaps but never through a wall', () => {
    const street = chapter.scenes.find((s) => s.id === 'colossae-street');
    if (!street) throw new Error('missing scene');
    const site = readSite(parseLayout(street), 'paving');
    expect(nextColumn(site, 10, 5, 1, 0)).toBe(3); // the stoa: columns three tiles apart
    expect(nextColumn(site, 22, 5, 1, 0)).toBeNull(); // the end of the row
    const walled = readSite(
      parseLayout({ id: 'w', layout: ['|#|'], legend: { '|': 'column', '#': 'wall' } }),
      'paving',
    );
    expect(nextColumn(walled, 0, 0, 1, 0)).toBeNull();
  });

  it('lights the gathering with its lampstands', () => {
    const house = chapter.scenes.find((s) => s.id === 'philemon-house');
    if (!house) throw new Error('missing scene');
    const lights = findLights(readSite(parseLayout(house), 'floor', { tallInterior: true }), true);
    expect(lights.filter((l) => l.kind === 'lamp').length).toBeGreaterThanOrEqual(4);
  });

  it('has a painted sprite for every placed prop', () => {
    const sprites = new Set(
      chapter.scenes.flatMap((s) => s.entities.map((e) => e.sprite ?? 'none')),
    );
    for (const sprite of sprites)
      expect(paintProp(sprite, recordingDocument()).known, sprite).toBe(true);
  });

  it('paints the new things people carry: tablets, a letter case, the player’s case', () => {
    const who = (id: string) => chapter.characters.find((c) => c.id === id)?.appearance;
    const zenon = who('zenon');
    const tychicus = who('tychicus');
    if (!zenon || !tychicus) throw new Error('missing characters');
    const cases = [
      { d: dressFor(zenon, [], '#7a4a34'), item: 'tablets' },
      { d: dressFor(tychicus, [], '#7a4a34'), item: 'scroll-case' },
      {
        d: dressFor(PLAYER_APPEARANCES['look-1'], ['letter-case'], '#7a4a34'),
        item: 'letter-case',
      },
    ];
    for (const { d, item } of cases) {
      expect(itemsOf(d), item).toContain(item);
      for (const dir of ['down', 'up', 'left', 'right'] as const) {
        const { ctx, calls } = recordingCtx();
        const rig = rigFor(d.build, dir, frameSpec(0));
        for (const layer of ['behind', 'body', 'front'] as const) paintCarry(ctx, d, rig, layer);
        expect(calls.length, `${item} facing ${dir}`).toBeGreaterThan(0);
      }
    }
  });
});

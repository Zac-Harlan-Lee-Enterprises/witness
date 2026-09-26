import { describe, expect, it } from 'vitest';
import { chapterSource, parseChapter } from '@/content';
import { STORM_ON_GALILEE } from '@/content/chapters/storm-on-galilee';
import { contentReport, reachabilityIssues } from '@/content/validation';
import { validateChapterIntegrity } from '@/domain/chapter-integrity';
import { EDUCATIONAL_KINDS } from '@/domain/content-records';
import { weatherOf } from '@/domain/weather';
import { isSolidTile, parseLayout, type TileKind } from '@/domain/world';
import { groundColor } from '@/game/art/terrain';
import { LOOKS } from '@/game/art/direction';
import { hasCanopy, heightOf, isPropTile, isStructure, readSite } from '@/game/art/site';
import { itemsOf, layerOf } from '@/game/art/people/gear';
import { dressFor } from '@/game/art/people/dress';
import { makeState } from '../support/state';

const chapter = parseChapter(STORM_ON_GALILEE);
const nodes = chapter.dialogues.flatMap((d) => d.nodes.map((n) => ({ dialogue: d.id, ...n })));
const allText = (): string[] => [
  ...nodes.flatMap((n) => [n.text, ...n.choices.map((c) => c.text)]),
  ...chapter.records.map((r) => r.body ?? ''),
  ...chapter.clues.map((c) => c.text),
  ...chapter.summary.consequences.map((c) => c.text),
  ...chapter.summary.recap.map((c) => c.text),
  ...chapter.scriptureConnection.comparisons.map((c) => c.text),
  ...chapter.puzzles.flatMap((p) => [p.intro, p.explanation, ...p.hints.map((h) => h.text)]),
];
const scene = (id: string) => {
  const s = chapter.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`no scene ${id}`);
  return s;
};

describe('A Storm on Galilee — content', () => {
  it('passes schema and referential integrity validation', () => {
    expect(validateChapterIntegrity(chapter)).toEqual([]);
  });

  it('lets the player reach every interactive thing and exit from every spawn', () => {
    expect(reachabilityIssues(chapter)).toEqual([]);
  });

  it('loads through the lazy chapter registry as Chapter 2', async () => {
    const meta = chapterSource.list().find((m) => m.id === 'storm-on-galilee');
    expect(meta).toMatchObject({ number: 2, available: true });
    const loaded = await chapterSource.load('storm-on-galilee');
    expect(loaded.title).toBe('A Storm on Galilee');
  });

  it('uses all four puzzle types, each with tiered hints and an explanation', () => {
    expect(new Set(chapter.puzzles.map((p) => p.type))).toEqual(
      new Set(['packing', 'measuring', 'deduction', 'sequence']),
    );
    for (const p of chapter.puzzles) {
      expect(p.hints.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.explanation.length, p.id).toBeGreaterThan(40);
    }
  });

  it('has a main quest and a genuinely optional side quest with an alternate outcome', () => {
    expect(chapter.quests.find((q) => q.kind === 'main')?.id).toBe(chapter.mainQuest);
    const side = chapter.quests.filter((q) => q.kind === 'side');
    expect(side.map((q) => q.id)).toEqual(['q-brine']);
    expect(side[0]?.autoStart).toBe(false);
    expect(side[0]?.outcomes.some((o) => o.kind === 'alternate')).toBe(true);
    // Nothing in the main quest waits on the side quest.
    const main = JSON.stringify(chapter.quests.find((q) => q.kind === 'main'));
    expect(main).not.toMatch(/q-brine|p-brine|brine-done/);
  });

  it('keeps Scripture as references, and labels every retelling as a paraphrase', () => {
    chapter.records
      .filter((r) => r.kind === 'scripture')
      .forEach((r) => expect(r.body, r.id).toBeUndefined());
    expect(chapter.records.find((r) => r.id === 'rec-mark-4-35-41')?.scripture).toEqual([
      { book: 'Mark', chapter: 4, verseStart: 35, verseEnd: 41 },
    ]);
    // Lines that retell the scene on the shore or the evening are labelled paraphrases.
    for (const [dialogue, id] of [
      ['d-opening', 'n3'],
      ['d-dinah', 'd2'],
      ['d-evening', 'ev1'],
    ] as const) {
      const n = nodes.find((x) => x.dialogue === dialogue && x.id === id);
      expect(n?.kind, `${dialogue}/${id}`).toBe('paraphrase');
      expect(chapter.records.find((r) => r.id === n?.recordId)?.kind).toBe('paraphrase');
    }
    // Any line naming Jesus is a labelled paraphrase or a how-to-play line, never fiction.
    nodes
      .filter((n) => /\bJesus\b/.test(n.text))
      .forEach((n) => expect(['paraphrase', 'instruction'], n.id).toContain(n.kind));
  });

  it('never shows or voices Jesus, and never retells what happened in his boat in the story', () => {
    expect(chapter.characters.every((c) => c.fictional && !c.biblicalFigure)).toBe(true);
    expect(chapter.characters.some((c) => /jesus|teacher/i.test(c.name))).toBe(false);
    nodes.forEach((n) => expect(n.speaker).not.toMatch(/jesus|teacher/i));
    for (const s of chapter.scenes)
      for (const e of s.entities)
        if (/teacher/i.test(e.label)) expect(e.characterId, e.id).toBeUndefined();
    // His words in Mark 4:35–41 are never put into anyone's mouth in the story…
    const spoken = nodes.map((n) => n.text).join('\n');
    expect(spoken).not.toMatch(
      /Peace! Be still|Why are you so afraid|little faith|don’t you care/i,
    );
    // …and what happened aboard his boat (asleep on the cushion, rebuking the wind) comes only from Scripture.
    expect(spoken).not.toMatch(/\b(asleep|cushion|rebuk)/i);
  });

  it('contains no faith, holiness or salvation scoring language', () => {
    const text = allText().join('\n');
    expect(text).not.toMatch(
      /\b(faith|holiness|salvation|righteousness) (score|points|meter|level)\b/i,
    );
    expect(text).not.toMatch(/\bgood Christian answer\b/i);
    expect(text).not.toMatch(/\byou (sinned|failed God)\b/i);
  });

  it('never ties the calm, safety or loss to the player’s faith or worth', () => {
    const text = allText().join('\n');
    expect(text).not.toMatch(/(because|since) (you|they) (had|lacked|showed) (faith|no faith)/i);
    expect(text).not.toMatch(/\b(god|heaven) (rewarded|punished)/i);
    expect(text).not.toMatch(
      /(calm|wind (stopped|dropped))[^.]{0,60}because (you|of you|of what you)/i,
    );
    expect(text).not.toMatch(/\bstorms? (come|came) because\b/i);
  });

  it('marks all educational content as awaiting human review (none self-approved)', () => {
    const report = contentReport(chapter);
    expect(report.approved).toBe(0);
    expect(report.awaitingReview).toBe(report.educational);
    chapter.records
      .filter((r) => EDUCATIONAL_KINDS.includes(r.kind))
      .forEach((r) => {
        expect(['ai-draft', 'sources-attached'], r.id).toContain(r.governance.status);
        expect(r.governance.provenance, r.id).toBe('ai-assisted');
      });
  });

  it('cites only sources that were actually retrieved, and uses every one of them', () => {
    expect(chapter.sources.every((s) => s.verified && s.url)).toBe(true);
    const cited = new Set(chapter.records.flatMap((r) => r.sources));
    expect(chapter.sources.filter((s) => !cited.has(s.id)).map((s) => s.id)).toEqual([]);
    chapter.records
      .filter((r) => r.kind === 'historical' || r.kind === 'reconstruction')
      .forEach((r) => expect(r.governance.historicalConfidence, r.id).not.toBe('not-applicable'));
  });

  it('labels the fiction: every character is a story record, and differing readings are flagged', () => {
    for (const c of chapter.characters.filter((x) => x.journalEntry))
      expect(chapter.records.find((r) => r.id === `rec-p-${c.id}`)?.kind, c.id).toBe('fiction');
    const views = chapter.records.find((r) => r.id === 'rec-interp-miracle-views');
    expect(views?.governance.denominationalSensitivity).toBe('high');
    expect(views?.governance.sensitivityNote).toBeTruthy();
    chapter.records
      .filter((r) => r.kind === 'interpretation')
      .forEach((r) => expect(r.governance.sensitivityNote, r.id).toBeTruthy());
  });

  it('offers a real choice in the storm: several options, constraints shown, none a morality button', () => {
    const decide = chapter.dialogues
      .find((d) => d.id === 'd-small-boat')
      ?.nodes.find((n) => n.id === 'decide');
    expect(decide?.choices.length).toBeGreaterThanOrEqual(4);
    decide?.choices.forEach((c) =>
      expect(c.text).not.toMatch(/\b(good|evil|right thing|wrong thing|sin|selfish)\b/i),
    );
    // What you didn't pack is shown as a reason, not hidden.
    expect(decide?.choices.filter((c) => c.requires && c.unavailableText).length).toBe(2);
  });

  it('drives the lake’s weather from the story: calm, wind, storm, then a great calm', () => {
    const lake = scene('open-lake');
    const at = (flags: string[]) =>
      weatherOf(lake, makeState({ flags: Object.fromEntries(flags.map((f) => [f, true])) }));
    expect(at([])).toBe('clear');
    expect(at(['wind-rising'])).toBe('wind');
    expect(at(['wind-rising', 'storm-broke'])).toBe('storm');
    expect(at(['wind-rising', 'storm-broke', 'great-calm'])).toBe('clear');
    // The afternoon westerly on the shore drops by evening.
    const shore = scene('capernaum-shore');
    expect(weatherOf(shore, makeState())).toBe('wind');
    expect(weatherOf(shore, makeState({ flags: { evening: true } }))).toBe('clear');
  });

  it('builds its places from tile kinds that name real things, all of which the painter knows', () => {
    const used = new Set<TileKind>(chapter.scenes.flatMap((s) => Object.values(s.legend)));
    for (const k of [
      'lake',
      'shallows',
      'shingle',
      'jetty',
      'boat',
      'hull',
      'deck',
      'mast',
      'nets',
      'rack',
    ] as const)
      expect(used.has(k), k).toBe(true);
    // Anything solid is either a standing object or painted in its own pass (water, boats, walls);
    // the new walkable kinds each have their own material, not the sand fallback.
    for (const k of used) if (isSolidTile(k)) expect(isPropTile(k) || isStructure(k), k).toBe(true);
    for (const k of ['shingle', 'jetty', 'deck'] as const)
      for (const look of Object.values(LOOKS))
        expect(groundColor(look, k), `${k} in ${look.mood}`).not.toBe(look.ground.sand);
    // Water, hulls and boats block; beaches, jetties and decks are walked on.
    expect(
      ['lake', 'shallows', 'hull', 'boat', 'mast', 'nets', 'rack'].every((k) =>
        isSolidTile(k as TileKind),
      ),
    ).toBe(true);
    expect(['shingle', 'jetty', 'deck'].every((k) => !isSolidTile(k as TileKind))).toBe(true);
    expect(hasCanopy('mast')).toBe(true);
    expect(heightOf('mast')).toBeGreaterThan(heightOf('nets'));
    expect(groundColor(LOOKS.oasis, 'shingle')).not.toBe(groundColor(LOOKS.oasis, 'sand'));
    // The mast stands on the deck it is stepped in.
    const lake = scene('open-lake');
    const site = readSite(parseLayout(lake), lake.baseTile);
    expect(site.groundAt(19, 11)).toBe('deck');
    // A boat drawn up on the beach sits on the beach.
    const shore = scene('capernaum-shore');
    expect(readSite(parseLayout(shore), shore.baseTile).groundAt(38, 15)).toBe('shingle');
  });

  it('dresses fishing folk with their gear: a net over the shoulder, an oar in hand', () => {
    const tamar = chapter.characters.find((c) => c.id === 'tamar');
    const elazar = chapter.characters.find((c) => c.id === 'elazar');
    if (!tamar || !elazar) throw new Error('missing characters');
    expect(itemsOf(dressFor(tamar.appearance, [], '#000000'))).toContain('net');
    expect(itemsOf(dressFor(elazar.appearance, [], '#000000'))).toContain('oar');
    const rig = { dir: 'down' } as Parameters<typeof layerOf>[1];
    expect(layerOf('net', rig)).toBe('body');
  });

  it('never lets anyone stand on water: every person and spawn is on a walkable tile or in a boat', () => {
    for (const s of chapter.scenes) {
      const grid = parseLayout(s);
      for (const e of s.entities.filter((x) => x.characterId)) {
        const k = grid.tiles[e.y]?.[e.x] as TileKind;
        expect(!isSolidTile(k) || k === 'boat', `${s.id}/${e.id} on ${k}`).toBe(true);
      }
    }
  });
});

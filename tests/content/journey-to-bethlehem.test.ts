import { describe, expect, it } from 'vitest';
import { chapterSource, parseChapter } from '@/content';
import { JOURNEY_TO_BETHLEHEM } from '@/content/chapters/journey-to-bethlehem';
import { contentReport, reachabilityIssues } from '@/content/validation';
import { validateChapterIntegrity } from '@/domain/chapter-integrity';
import { EDUCATIONAL_KINDS } from '@/domain/content-records';
import { isSolidTile, parseLayout, TILE_KINDS, type TileKind } from '@/domain/world';
import { findLights, heightOf, isLowWall, isPropTile, readSite } from '@/game/art/site';
import { isKnownProp } from '@/game/art/props';

const chapter = parseChapter(JOURNEY_TO_BETHLEHEM);

/** Every sentence the player can read that is NOT a labelled paraphrase or Scripture record. */
const plainText = (): string[] => [
  ...chapter.dialogues.flatMap((d) =>
    d.nodes.flatMap((n) => [
      ...(n.kind === 'paraphrase' ? [] : [n.text]),
      ...n.choices.map((c) => c.text),
    ]),
  ),
  ...chapter.records.filter((r) => r.kind !== 'paraphrase').map((r) => r.body ?? ''),
  ...chapter.clues.map((c) => c.text),
  ...chapter.summary.consequences.map((c) => c.text),
  ...chapter.summary.recap.map((c) => c.text),
  ...chapter.summary.reflectionPrompts,
  ...chapter.scriptureConnection.comparisons.map((c) => c.text),
  chapter.scriptureConnection.intro,
];
const allText = (): string[] => [
  ...plainText(),
  ...chapter.dialogues.flatMap((d) => d.nodes.map((n) => n.text)),
  ...chapter.records.map((r) => r.body ?? ''),
];

/**
 * Distinctive wording from the World English Bible text of Luke 2:1–20
 * (ebible.org/eng-web/LUK02.htm). None of it may appear in the chapter:
 * verse text comes only from the Scripture text provider.
 */
const WEB_LUKE_2 = [
  'a decree went out from Caesar Augustus',
  'all the world should be enrolled',
  'wrapped him in bands of cloth',
  'there was no room for them in the inn',
  'keeping watch by night over their flock',
  'the glory of the Lord shone around them',
  'good news of great joy which will be to all the people',
  'there is born to you today',
  'you will find a baby wrapped in strips of cloth',
  'glory to god in the highest, on earth peace',
  'they publicized widely the saying',
  'wondered at the things which were spoken to them',
  'kept all these sayings, pondering them in her heart',
  'glorifying and praising god for all the things',
];

describe('A Journey to Bethlehem content', () => {
  it('passes schema and referential integrity validation', () => {
    expect(validateChapterIntegrity(chapter)).toEqual([]);
  });

  it('lets the player reach every interactive thing and exit from every spawn', () => {
    expect(reachabilityIssues(chapter)).toEqual([]);
  });

  it('loads through the lazy chapter registry', async () => {
    const loaded = await chapterSource.load('journey-to-bethlehem');
    expect(loaded.id).toBe('journey-to-bethlehem');
    const meta = chapterSource.list().find((m) => m.id === 'journey-to-bethlehem');
    expect(meta).toMatchObject({ number: 3, available: true, title: 'A Journey to Bethlehem' });
  });

  it('is built on Luke 2:1–20 with 3–5 scenes', () => {
    expect(chapter.scenes.length).toBeGreaterThanOrEqual(3);
    expect(chapter.scenes.length).toBeLessThanOrEqual(5);
    const passage = chapter.records.find((r) => r.id === 'rec-luke-2-1-20');
    expect(passage?.scripture?.[0]).toMatchObject({
      book: 'Luke',
      chapter: 2,
      verseStart: 1,
      verseEnd: 20,
    });
  });

  it('uses all four puzzle types, each with tiered hints and an explanation', () => {
    expect(new Set(chapter.puzzles.map((p) => p.type))).toEqual(
      new Set(['packing', 'measuring', 'deduction', 'sequence']),
    );
    for (const p of chapter.puzzles) {
      expect(p.hints.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.explanation.length, p.id).toBeGreaterThan(20);
    }
  });

  it('has a main quest and a genuinely optional side quest with an alternate outcome', () => {
    expect(chapter.quests.find((q) => q.kind === 'main')?.id).toBe(chapter.mainQuest);
    const side = chapter.quests.filter((q) => q.kind === 'side');
    expect(side.map((q) => q.id)).toEqual(['q-queue']);
    expect(side[0]?.outcomes.some((o) => o.kind === 'alternate')).toBe(true);
    // The main quest never waits on the side quest.
    const main = JSON.stringify(chapter.quests.find((q) => q.id === chapter.mainQuest));
    expect(main).not.toMatch(/p-register|q-queue/);
  });

  it('never embeds verse text: Scripture records hold references only, and no WEB wording appears', () => {
    chapter.records
      .filter((r) => r.kind === 'scripture')
      .forEach((r) => expect(r.body, r.id).toBeUndefined());
    const text = allText().join('\n').toLowerCase().replace(/[’']/g, "'");
    for (const phrase of WEB_LUKE_2) expect(text, phrase).not.toContain(phrase);
  });

  it('labels every retelling of Scripture as a paraphrase linked to a paraphrase record', () => {
    const lines = chapter.dialogues.flatMap((d) => d.nodes);
    const retellings = lines.filter((n) =>
      /angel|Savior|Christ the Lord|Abraham|David (kept|was hiding)|mighty men/.test(n.text),
    );
    expect(retellings.length).toBeGreaterThan(5);
    for (const n of retellings) {
      expect(n.kind, n.text).toBe('paraphrase');
      const rec = chapter.records.find((r) => r.id === n.recordId);
      expect(rec?.kind, n.text).toBe('paraphrase');
    }
  });

  it('keeps every character fictional; the people of Luke 2 never appear, speak or are played', () => {
    expect(chapter.characters.every((c) => c.fictional && !c.biblicalFigure)).toBe(true);
    const offStage = /\b(jesus|mary|joseph|angel|gabriel|herod|quirinius|augustus|caesar)\b/i;
    chapter.characters.forEach((c) => expect(c.name).not.toMatch(offStage));
    chapter.dialogues
      .flatMap((d) => d.nodes)
      .forEach((n) => expect(n.speaker).not.toMatch(offStage));
    chapter.scenes
      .flatMap((s) => s.entities)
      .forEach((e) => expect(e.label, e.id).not.toMatch(offStage));
  });

  it('contains no faith, holiness or favor scoring language', () => {
    const text = allText().join('\n');
    expect(text).not.toMatch(
      /\b(faith|holiness|salvation|righteousness|favou?r) (score|points|meter|level)\b/i,
    );
    expect(text).not.toMatch(/\bgood Christian answer\b/i);
    expect(text).not.toMatch(/\byou (sinned|failed God)\b/i);
    expect(text).not.toMatch(/\b(score|points)\b/i);
  });

  it('marks every record as an AI-assisted draft awaiting review — nothing self-approved', () => {
    const report = contentReport(chapter);
    expect(report.approved).toBe(0);
    expect(report.awaitingReview).toBe(report.educational);
    for (const r of chapter.records) {
      expect(r.governance.provenance, r.id).toBe('ai-assisted');
      expect(r.governance.reviewer, r.id).toBeUndefined();
      expect(['ai-draft', 'sources-attached'], r.id).toContain(r.governance.status);
    }
    chapter.records
      .filter((r) => EDUCATIONAL_KINDS.includes(r.kind))
      .forEach((r) => expect(r.governance.status, r.id).toBe('sources-attached'));
  });

  it('cites only sources that were actually retrieved, with a URL', () => {
    expect(chapter.sources.every((s) => s.verified && s.url)).toBe(true);
    const cited = new Set(chapter.records.flatMap((r) => r.sources));
    for (const id of cited)
      expect(
        chapter.sources.some((s) => s.id === id),
        id,
      ).toBe(true);
  });

  it('presents the census date honestly as uncertain, with Josephus and Luke side by side', () => {
    const quirinius = chapter.records.find((r) => r.id === 'rec-hist-quirinius');
    expect(quirinius?.governance.historicalConfidence).toBe('uncertain');
    expect(quirinius?.body).toMatch(/Josephus/);
    expect(quirinius?.body).toMatch(/Herod/);
    expect(quirinius?.body).toMatch(/open question|not treat the date as settled/);
    expect(quirinius?.sources).toEqual(
      expect.arrayContaining(['src-josephus-ant', 'src-web-luk02']),
    );
    const ownCity = chapter.records.find((r) => r.id === 'rec-hist-own-city');
    expect(ownCity?.governance.historicalConfidence).toBe('uncertain');
  });

  it('flags where Christians differ with interpretation records and sensitivity notes', () => {
    for (const id of ['rec-interp-katalyma', 'rec-interp-date', 'rec-interp-two-accounts']) {
      const r = chapter.records.find((x) => x.id === id);
      expect(r?.kind, id).toBe('interpretation');
      expect(r?.governance.denominationalSensitivity, id).not.toBe('none');
      expect(r?.governance.sensitivityNote, id).toBeTruthy();
    }
    // Traditions are labelled as traditions.
    expect(
      chapter.records.find((r) => r.id === 'rec-hist-cave')?.governance.historicalConfidence,
    ).toBe('tradition');
  });

  it('offers a real decision at the door: several options, constraints shown, none a morality button', () => {
    const decide = chapter.dialogues
      .find((d) => d.id === 'd-zerah')
      ?.nodes.find((n) => n.id === 'z4');
    expect(decide?.choices.length).toBeGreaterThanOrEqual(4);
    decide?.choices.forEach((c) =>
      expect(c.text).not.toMatch(/\b(good|evil|right thing|wrong thing|sin|kind|selfish)\b/i),
    );
    // Options that depend on earlier choices stay visible, with the reason when unavailable.
    decide?.choices
      .filter((c) => c.requires)
      .forEach((c) => expect(c.unavailableText, c.id).toBeTruthy());
  });

  it('uses only prop sprites the painter knows', () => {
    const sprites = chapter.scenes.flatMap((s) => s.entities.map((e) => e.sprite ?? 'none'));
    for (const sprite of sprites) expect(isKnownProp(sprite), sprite).toBe(true);
  });

  it('names real, buildable things with its new tiles, and gives each one a painter rule', () => {
    const used = new Set(chapter.scenes.flatMap((s) => Object.values(s.legend)));
    const added: TileKind[] = [
      'straw',
      'platform',
      'threshing',
      'manger',
      'sheepfold',
      'terrace',
      'sheep',
      'hay',
      'campfire',
    ];
    for (const kind of added) {
      expect(kind in TILE_KINDS, kind).toBe(true);
      expect(used.has(kind), `${kind} is used in a map`).toBe(true);
      // Ground is walkable; anything standing up casts a shadow as a prop or a low wall.
      if (isSolidTile(kind)) {
        expect(isPropTile(kind) || isLowWall(kind), kind).toBe(true);
        expect(heightOf(kind), kind).toBeGreaterThan(0);
      }
    }
  });

  it('paints the fold and its fire the way the place reads: walls on the ground, a fire that glows', () => {
    const fields = chapter.scenes.find((s) => s.id === 'shepherds-fields');
    if (!fields) throw new Error('missing fields');
    const site = readSite(parseLayout(fields), fields.baseTile);
    // A fold wall and a terrace wall stand on ordinary ground, like a garden wall does.
    expect(site.kindAt(8, 9)).toBe('sheepfold');
    expect(site.groundAt(8, 9)).toBe('scrub');
    expect(site.groundAt(10, 5)).not.toBe('terrace');
    // The shepherds' fire lights the dusk.
    expect(findLights(site, false).some((l) => l.kind === 'hearth' && l.x === 10 * 32 + 16)).toBe(
      true,
    );
    // Inside the house, the step between the animals' straw and the family floor is walkable.
    const house = chapter.scenes.find((s) => s.id === 'tamar-house');
    if (!house) throw new Error('missing house');
    const grid = parseLayout(house);
    expect(grid.tiles[7]?.[7]).toBe('steps');
    expect(isSolidTile('straw') || isSolidTile('platform')).toBe(false);
  });
});

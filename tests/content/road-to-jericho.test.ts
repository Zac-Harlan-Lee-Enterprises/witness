import { describe, expect, it } from 'vitest';
import { chapterSource, parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { contentReport, reachabilityIssues } from '@/content/validation';
import { validateChapterIntegrity } from '@/domain/chapter-integrity';
import { EDUCATIONAL_KINDS } from '@/domain/content-records';

const chapter = parseChapter(ROAD_TO_JERICHO);
const allText = (): string[] => [
  ...chapter.dialogues.flatMap((d) =>
    d.nodes.flatMap((n) => [n.text, ...n.choices.map((c) => c.text)]),
  ),
  ...chapter.records.map((r) => r.body ?? ''),
  ...chapter.clues.map((c) => c.text),
  ...chapter.summary.consequences.map((c) => c.text),
  ...chapter.summary.recap.map((c) => c.text),
  ...chapter.scriptureConnection.comparisons.map((c) => c.text),
];

describe('Road to Jericho content', () => {
  it('passes schema and referential integrity validation', () => {
    expect(validateChapterIntegrity(chapter)).toEqual([]);
  });

  it('lets the player reach every interactive thing and exit from every spawn', () => {
    expect(reachabilityIssues(chapter)).toEqual([]);
  });

  it('loads through the lazy chapter registry', async () => {
    const loaded = await chapterSource.load('road-to-jericho');
    expect(loaded.id).toBe('road-to-jericho');
    await expect(chapterSource.load('storm-on-galilee')).rejects.toThrow(/not available/);
  });

  it('includes at least three distinct puzzle types', () => {
    expect(new Set(chapter.puzzles.map((p) => p.type)).size).toBeGreaterThanOrEqual(3);
  });

  it('has a main quest and at least one optional side quest with alternate outcomes', () => {
    expect(chapter.quests.find((q) => q.kind === 'main')?.id).toBe(chapter.mainQuest);
    const side = chapter.quests.filter((q) => q.kind === 'side');
    expect(side.length).toBeGreaterThanOrEqual(1);
    expect(side[0]?.outcomes.some((o) => o.kind !== 'success')).toBe(true);
  });

  it('never embeds verse text in Scripture records and labels every retelling as paraphrase', () => {
    chapter.records
      .filter((r) => r.kind === 'scripture')
      .forEach((r) => expect(r.body).toBeUndefined());
    const paraphraseLines = chapter.dialogues
      .flatMap((d) => d.nodes)
      .filter((n) => /Jesus|teacher told|Samaritan came/.test(n.text) && n.speaker === 'yair');
    paraphraseLines
      .filter((n) => n.id !== 'y6' && n.id !== 'y9' && n.id !== 'y1')
      .forEach((n) => expect(n.kind, `node ${n.id}`).toBe('paraphrase'));
  });

  it('keeps every character fictional and never makes Jesus a character', () => {
    expect(chapter.characters.every((c) => c.fictional && !c.biblicalFigure)).toBe(true);
    expect(chapter.characters.some((c) => /jesus/i.test(c.name))).toBe(false);
    chapter.dialogues
      .flatMap((d) => d.nodes)
      .forEach((n) => expect(n.speaker).not.toMatch(/jesus/i));
  });

  it('contains no faith/holiness/salvation scoring language', () => {
    const text = allText().join('\n');
    expect(text).not.toMatch(
      /\b(faith|holiness|salvation|righteousness) (score|points|meter|level)\b/i,
    );
    expect(text).not.toMatch(/\bgood Christian answer\b/i);
    expect(text).not.toMatch(/\byou (sinned|failed God)\b/i);
  });

  it('does not attribute a motive to the priest or the Levite', () => {
    const text = allText().join('\n').toLowerCase();
    expect(text).not.toMatch(
      /(priest|levite)[^.]{0,80}(because|so that|to avoid)[^.]{0,40}(unclean|purity|defile)/,
    );
  });

  it('marks all educational content as awaiting human review (none self-approved)', () => {
    const report = contentReport(chapter);
    expect(report.approved).toBe(0);
    expect(report.awaitingReview).toBe(report.educational);
    chapter.records
      .filter((r) => EDUCATIONAL_KINDS.includes(r.kind))
      .forEach((r) => expect(['ai-draft', 'sources-attached']).toContain(r.governance.status));
  });

  it('cites only sources that were actually retrieved', () => {
    expect(chapter.sources.every((s) => s.verified && s.url)).toBe(true);
  });

  it('offers a real choice at the injured traveler: at least three options, none a morality button', () => {
    const decide = chapter.dialogues
      .find((d) => d.id === 'd-menashe-road')
      ?.nodes.find((n) => n.id === 'decide');
    expect(decide?.choices.length).toBeGreaterThanOrEqual(3);
    decide?.choices.forEach((c) =>
      expect(c.text).not.toMatch(/\b(good|evil|right thing|wrong thing|sin)\b/i),
    );
  });
});
